-- Migration 0004: 토스 OAuth login-me 에서 받은 사용자 이름 저장.
--   user_name scope에 동의한 사용자는 login-me 응답에 name 필드가 포함됨.
--   클라가 공유 메시지에 "{이름}님의" prefix를 붙일 때 사용.
ALTER TABLE `users` ADD COLUMN `name` text;
