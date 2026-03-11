// Supabase Bağlantı Bilgilerini window Objesine Ekle
window.supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
window.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
window.supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);

/* === EXCEL GÖRÜNÜMÜ JS === */
let excelCurrentData = [];
