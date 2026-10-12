import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://express-mcp-service.adobe.io/mcp",
  description: "Create and edit designs with Adobe Express.",
  auth: connect("express-mcp-service.adobe.io/" + process.env.VERCEL_PROJECT_ID),
});
