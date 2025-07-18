// Test importing one piece at a time
console.log("Testing imports step by step...")

console.log("1. Starting plain server...")
const server = Bun.serve({
  port: 4000,
  fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/api/games") {
      return new Response("Test response")
    }
    return new Response("Not found", { status: 404 })
  }
})

console.log("2. Plain server started on", server.port)
export default server
