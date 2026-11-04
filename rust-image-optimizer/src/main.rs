use axum::{
    extract::Multipart,
    http::{header, HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use image::{imageops::FilterType, DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use serde::Serialize;
use std::io::Cursor;
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    engine: &'static str,
    max_width: u32,
}

#[derive(Serialize)]
struct OptimizeJsonResponse {
    success: bool,
    original_size: usize,
    optimized_size: usize,
    original_width: u32,
    original_height: u32,
    optimized_width: u32,
    optimized_height: u32,
    data_url: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,image_optimizer=debug".into()),
        )
        .init();

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/optimize", post(optimize_binary_handler))
        .route("/optimize-json", post(optimize_json_handler))
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".into());
    let addr = format!("0.0.0.0:{}", port);
    info!("🚀 Rust Axum Image Optimizer running on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind port");

    axum::serve(listener, app).await.expect("Server failed");
}

async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "skyinventory-rust-image-optimizer",
        engine: "Rust 1.80 + Axum + SIMD Image Engine",
        max_width: 400,
    })
}

// Resizes image to max 400px wide, preserving original aspect ratio and honoring EXIF orientation
fn process_image(file_bytes: &[u8]) -> Result<(Vec<u8>, (u32, u32), (u32, u32)), String> {
    let cursor = Cursor::new(file_bytes);
    let mut img = match ImageReader::new(cursor).with_guessed_format() {
        Ok(reader) => match reader.into_decoder() {
            Ok(mut decoder) => {
                let orientation = decoder
                    .orientation()
                    .unwrap_or(image::metadata::Orientation::NoTransforms);
                match DynamicImage::from_decoder(decoder) {
                    Ok(mut decoded) => {
                        decoded.apply_orientation(orientation);
                        decoded
                    }
                    Err(_) => match image::load_from_memory(file_bytes) {
                        Ok(i) => i,
                        Err(e) => return Err(format!("Failed to decode image: {}", e)),
                    },
                }
            }
            Err(_) => match image::load_from_memory(file_bytes) {
                Ok(i) => i,
                Err(e) => return Err(format!("Failed to decode image: {}", e)),
            },
        },
        Err(_) => match image::load_from_memory(file_bytes) {
            Ok(i) => i,
            Err(e) => return Err(format!("Failed to decode image: {}", e)),
        },
    };

    let orig_w = img.width();
    let orig_h = img.height();

    // Convert max 400 pixel wide and keep original aspect ratio
    let resized = if orig_w > 400 {
        let target_w = 400;
        let target_h = ((orig_h as f64) * (400.0 / orig_w as f64)).round().max(1.0) as u32;
        img.resize(target_w, target_h, FilterType::Triangle)
    } else {
        img
    };

    let new_w = resized.width();
    let new_h = resized.height();

    // Encode to WebP for modern, highly-compressed output
    let mut out_buf = Cursor::new(Vec::with_capacity(32 * 1024));
    if let Err(e) = resized.write_to(&mut out_buf, ImageFormat::WebP) {
        return Err(format!("Failed to encode WebP: {}", e));
    }

    Ok((out_buf.into_inner(), (orig_w, orig_h), (new_w, new_h)))
}

async fn extract_bytes_from_multipart_or_raw(multipart: &mut Multipart) -> Result<Vec<u8>, String> {
    while let Ok(Some(field)) = multipart.next_field().await {
        if let Ok(data) = field.bytes().await {
            if !data.is_empty() {
                return Ok(data.to_vec());
            }
        }
    }
    Err("No file data found in multipart request".to_string())
}

// POST /optimize -> returns binary image/webp
async fn optimize_binary_handler(mut multipart: Multipart) -> Response {
    let file_bytes = match extract_bytes_from_multipart_or_raw(&mut multipart).await {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    match process_image(&file_bytes) {
        Ok((out_bytes, (orig_w, orig_h), (new_w, new_h))) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/webp"));
            headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=31536000, immutable"),
            );
            headers.insert(
                HeaderName::from_static("x-engine"),
                HeaderValue::from_static("rust-axum-image"),
            );
            headers.insert(
                HeaderName::from_static("x-original-width"),
                HeaderValue::from_str(&orig_w.to_string()).unwrap(),
            );
            headers.insert(
                HeaderName::from_static("x-original-height"),
                HeaderValue::from_str(&orig_h.to_string()).unwrap(),
            );
            headers.insert(
                HeaderName::from_static("x-optimized-width"),
                HeaderValue::from_str(&new_w.to_string()).unwrap(),
            );
            headers.insert(
                HeaderName::from_static("x-optimized-height"),
                HeaderValue::from_str(&new_h.to_string()).unwrap(),
            );

            (StatusCode::OK, headers, out_bytes).into_response()
        }
        Err(err) => (StatusCode::UNPROCESSABLE_ENTITY, err).into_response(),
    }
}

// POST /optimize-json -> returns JSON with base64
async fn optimize_json_handler(mut multipart: Multipart) -> Response {
    let file_bytes = match extract_bytes_from_multipart_or_raw(&mut multipart).await {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    match process_image(&file_bytes) {
        Ok((out_bytes, (orig_w, orig_h), (new_w, new_h))) => {
            let b64 = format!("data:image/webp;base64,{}", simple_base64_encode(&out_bytes));
            Json(OptimizeJsonResponse {
                success: true,
                original_size: file_bytes.len(),
                optimized_size: out_bytes.len(),
                original_width: orig_w,
                original_height: orig_h,
                optimized_width: new_w,
                optimized_height: new_h,
                data_url: b64,
            })
            .into_response()
        }
        Err(err) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "success": false, "error": err })),
        )
            .into_response(),
    }
}

fn simple_base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            out.push(TABLE[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }

        if chunk.len() > 2 {
            out.push(TABLE[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }

    out
}
