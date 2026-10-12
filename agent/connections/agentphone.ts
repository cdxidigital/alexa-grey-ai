import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.agentphone.ai/mcp",
  description: "Give AI agents phone numbers for messages and voice calls.",
  auth: connect("mcp.agentphone.ai/" + process.env.VERCEL_PROJECT_ID),
});
