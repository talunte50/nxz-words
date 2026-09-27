const username = "finaladmin_" + Date.now();
const res = await fetch("http://127.0.0.1:3456/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password: "password123" }),
});
const body = await res.json().catch(() => ({}));
const role = body?.data?.profile?.role;
console.log(JSON.stringify(body, null, 2));
console.log("role:", role, "| expected: admin |", role === "admin" ? "PASS" : "FAIL");