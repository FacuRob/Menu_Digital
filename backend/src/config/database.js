const { createClient } = require("@supabase/supabase-js");

// NO llamar dotenv acá — ya lo hace server.js antes de requerir este módulo

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

module.exports = supabase;
