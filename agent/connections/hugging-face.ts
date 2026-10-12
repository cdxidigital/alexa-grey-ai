import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://huggingface.co/mcp?login&gradio=none",
  description: "Explore models, datasets, and Gradio apps.",
  auth: connect("huggingface.co/" + process.env.VERCEL_PROJECT_ID),
});
