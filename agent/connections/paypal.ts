import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.paypal.com/mcp",
  description: "Manage payments, invoices, and subscriptions.",
  auth: connect("mcp.paypal.com/" + process.env.VERCEL_PROJECT_ID),
});
