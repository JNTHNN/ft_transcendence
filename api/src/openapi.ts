export const openapi = {
  openapi: "3.0.0",
  info: { title: "ft_transcendence", version: "0.1.0" },
  servers: [{ url: "https://api.localhost" }],
  paths: {
    "/auth/signup": {
      post: { requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Signup" }}}}, responses: { "201": { description: "Created" }}}
    },
    "/auth/login": {
      post: { requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Login" }}}}, responses: { "200": { description: "OK" }}}
    },
    "/health": { get: { responses: { "200": { description: "OK" }}} }
  },
  components: {
    schemas: {
      Signup: { type: "object", required: ["email","password","displayName"], properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
        displayName: { type: "string", minLength: 3, maxLength: 24 }
      }},
      Login: { type: "object", required: ["email","password"], properties: {
        email: { type: "string" }, password: { type: "string" }
      }}
    }
  }
};
