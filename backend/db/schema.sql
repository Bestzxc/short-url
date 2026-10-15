-- Short URL schema (matches docs/er-diagram: users 1:N links 1:N clicks)

CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS links (
  link_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  original_url       TEXT NOT NULL,
  -- random code or custom alias; case-sensitive so "aB3" and "ab3" are different links
  short_code         VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  link_password_hash VARCHAR(255) NULL,          -- NULL = no password
  expires_at         DATETIME NULL,              -- NULL = never expires
  max_clicks         INT UNSIGNED NULL,          -- NULL = unlimited
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_links_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  INDEX idx_links_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clicks (
  click_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  link_id     INT UNSIGNED NOT NULL,
  clicked_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  device_type VARCHAR(20) NOT NULL,               -- desktop | mobile | tablet
  CONSTRAINT fk_clicks_link FOREIGN KEY (link_id) REFERENCES links (link_id) ON DELETE CASCADE,
  INDEX idx_clicks_link (link_id, clicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
