async function run() {
  const loginRes = await fetch('http://127.0.0.1:4400/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  const data = await loginRes.json();
  const token = data.token;
  
  const openRes = await fetch('http://127.0.0.1:4400/api/register/open', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(openRes.status);
  console.log(await openRes.text());
}
run();
