import { Pool } from 'pg';
import crypto from 'crypto';

export interface SyncResult {
  success: boolean;
  timestamp: string;
  totalStalwartUsers: number;
  addedToKeycloak: string[];
  alreadyInKeycloak: string[];
  error?: string;
}

export const SKYCONNECTION_REALM_ID = '0dadbdef-88eb-47be-8368-9ebf9fcf4f98';
export const STALWART_INTERNAL_URL = process.env.STALWART_URL || 'http://mail-stalwart-mmfbt9-stalwart-mail-1:8080';

// Obtain Stalwart JMAP token using admin credentials
async function getStalwartToken(): Promise<string> {
  const authPayload = {
    type: 'authCode',
    accountName: 'admin@skyconnection.id',
    accountSecret: 'Gotroy50#PSmingguIT',
    clientId: 'admin',
    redirectUri: 'https://mailserver.skyconnection.id/admin/oauth/callback',
  };

  const authRes = await fetch(`${STALWART_INTERNAL_URL}/api/auth`, {
    method: 'POST',
    headers: {
      Host: 'mailserver.skyconnection.id',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(authPayload),
  });

  if (!authRes.ok) {
    throw new Error(`Stalwart auth failed with status ${authRes.status}: ${await authRes.text()}`);
  }

  const authData = await authRes.json();
  const code = authData.client_code;
  if (!code) {
    throw new Error('No client_code received from Stalwart');
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: 'admin',
    redirect_uri: 'https://mailserver.skyconnection.id/admin/oauth/callback',
  });

  const tokenRes = await fetch(`${STALWART_INTERNAL_URL}/auth/token`, {
    method: 'POST',
    headers: {
      Host: 'mailserver.skyconnection.id',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Stalwart token exchange failed with status ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Fetch all principals from Stalwart via JMAP
async function fetchStalwartUsers(): Promise<Array<{ email: string; name: string; username: string }>> {
  const token = await getStalwartToken();

  const jmapRes = await fetch(`${STALWART_INTERNAL_URL}/jmap/`, {
    method: 'POST',
    headers: {
      Host: 'mailserver.skyconnection.id',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:principals', 'urn:stalwart:jmap'],
      methodCalls: [['Principal/get', { accountId: 'b' }, '0']],
    }),
  });

  if (!jmapRes.ok) {
    throw new Error(`Stalwart JMAP request failed with status ${jmapRes.status}`);
  }

  const jmapData = await jmapRes.json();
  const list = jmapData.methodResponses?.[0]?.[1]?.list || [];

  const users: Array<{ email: string; name: string; username: string }> = [];
  for (const item of list) {
    const rawEmail = (item.email || item.name || '').trim().toLowerCase();
    if (rawEmail && rawEmail.includes('@')) {
      const parts = rawEmail.split('@');
      const username = parts[0];
      users.push({
        email: rawEmail,
        name: item.name || username,
        username: username,
      });
    }
  }

  return users;
}

// Synchronize all Stalwart users into Keycloak's PostgreSQL database
export async function syncStalwartToKeycloak(): Promise<SyncResult> {
  const kcPool = new Pool({
    host: process.env.KEYCLOAK_DB_HOST || 'database-postgresql-fy9a1w',
    port: parseInt(process.env.KEYCLOAK_DB_PORT || '5432', 10),
    user: process.env.KEYCLOAK_DB_USER || 'postgres',
    password: process.env.KEYCLOAK_DB_PASSWORD || 'dNGwXb9OCrJNNaJMoKI7',
    database: process.env.KEYCLOAK_DB_NAME || 'keycloack',
    connectionTimeoutMillis: 5000,
  });

  try {
    const stalwartUsers = await fetchStalwartUsers();
    const addedToKeycloak: string[] = [];
    const alreadyInKeycloak: string[] = [];

    // Query existing users in realm 'skyconnection'
    const existingUsersRes = await kcPool.query(
      `SELECT id, username, email FROM user_entity WHERE realm_id = $1;`,
      [SKYCONNECTION_REALM_ID]
    );

    const existingMap = new Map<string, any>();
    for (const u of existingUsersRes.rows) {
      if (u.email) existingMap.set(u.email.toLowerCase(), u);
      if (u.username) existingMap.set(u.username.toLowerCase(), u);
    }

    const now = Date.now();

    for (const user of stalwartUsers) {
      const lowerEmail = user.email.toLowerCase();
      const lowerUsername = user.username.toLowerCase();

      if (existingMap.has(lowerEmail) || existingMap.has(lowerUsername)) {
        alreadyInKeycloak.push(user.email);
        continue;
      }

      const newId = crypto.randomUUID();
      const emailConstraint = lowerEmail;

      await kcPool.query(
        `INSERT INTO user_entity (
          id, email, email_constraint, email_verified, enabled,
          first_name, last_name, realm_id, username, created_timestamp
        ) VALUES ($1, $2, $3, true, true, $4, null, $5, $6, $7);`,
        [newId, lowerEmail, emailConstraint, user.name || user.username, SKYCONNECTION_REALM_ID, lowerUsername, now]
      );

      addedToKeycloak.push(user.email);
      existingMap.set(lowerEmail, { id: newId });
    }

    await kcPool.end();

    const result: SyncResult = {
      success: true,
      timestamp: new Date().toISOString(),
      totalStalwartUsers: stalwartUsers.length,
      addedToKeycloak,
      alreadyInKeycloak,
    };

    console.log('[UserSync] Sync completed successfully:', result);
    return result;
  } catch (err: any) {
    try {
      await kcPool.end();
    } catch (_) {}
    console.error('[UserSync] Error syncing Stalwart to Keycloak:', err);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      totalStalwartUsers: 0,
      addedToKeycloak: [],
      alreadyInKeycloak: [],
      error: err.message,
    };
  }
}
