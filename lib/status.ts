export interface AssetStatus {
  id: number;
  value: string;
  name: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

export const ASSET_STATUSES: Record<number, AssetStatus> = {
  1: {
    id: 1,
    value: 'available',
    name: 'Available',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: '✓',
  },
  2: {
    id: 2,
    value: 'allocate',
    name: 'Allocated',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: '👤',
  },
  3: {
    id: 3,
    value: 'revocate',
    name: 'Revocated',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '↩️',
  },
  4: {
    id: 4,
    value: 'lost',
    name: 'Lost',
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    icon: '🔍',
  },
  5: {
    id: 5,
    value: 'found',
    name: 'Found',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: '📍',
  },
  6: {
    id: 6,
    value: 'broken',
    name: 'Broken',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: '⚠️',
  },
  7: {
    id: 7,
    value: 'dispose',
    name: 'Disposed',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: '🗑️',
  },
  8: {
    id: 8,
    value: 'donate',
    name: 'Donated',
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    icon: '🎁',
  },
  9: {
    id: 9,
    value: 'sell',
    name: 'Sold',
    color: 'text-amber-800',
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    icon: '💵',
  },
  10: {
    id: 10,
    value: 'repair',
    name: 'Under Repair',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: '🔧',
  },
  11: {
    id: 11,
    value: 'maintenance',
    name: 'Maintenance',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: '⚙️',
  },
};

export const getStatusInfo = (statusId: number): AssetStatus => {
  return ASSET_STATUSES[statusId] || ASSET_STATUSES[1];
};
