async function run() {
  const res = await fetch('http://127.0.0.1:4400/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  console.log(res.status);
  const data = await res.json();
  console.log(data);
}
run();
