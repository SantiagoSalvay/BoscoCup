// Crea el primer usuario admin via la Admin API de Supabase (service role).
// Uso: node scripts/create-admin.mjs <email> <password> <nombre>
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const [, , email, password, ...nombreParts] = process.argv;
const nombre = nombreParts.join(" ");

if (!email || !password || !nombre) {
  console.error("Uso: node scripts/create-admin.mjs <email> <password> <nombre>");
  process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

if (error) {
  console.error("Error creando el usuario:", error.message);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("profiles")
  .insert({ id: data.user.id, nombre, rol: "admin", activo: true });

if (profileError) {
  console.error("Usuario creado pero falló el perfil:", profileError.message);
  process.exit(1);
}

console.log(`Admin creado: ${email} (id: ${data.user.id})`);
