import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://api.lovable.dev/mcp",
  description: "Build and update web applications.",
  auth: connect("api.lovable.dev/" + process.env.VERCEL_PROJECT_ID),
});
