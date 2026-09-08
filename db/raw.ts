import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw new Error('ฐานข้อมูลยังไม่พร้อม กรุณาลองใหม่');
  return env.DB;
}
