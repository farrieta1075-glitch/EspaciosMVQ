/**
 * Genera claves VAPID para Web Push.
 * Uso: node scripts/generate-vapid-keys.mjs
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Añade esto a Vercel (.env) y a .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('WEB_PUSH_VAPID_SUBJECT=mailto:tu@tudominio.com');
