import type { ComponentProps, FC } from "react";
import { MyDocument } from "./pdf";
import { PDFViewer } from "@react-pdf/renderer";

// Kept in its own module so @react-pdf/renderer is only loaded when needed
const ResumePreview: FC<ComponentProps<typeof MyDocument>> = (props) => (
  <PDFViewer className="h-full w-full">
    <MyDocument {...props} />
  </PDFViewer>
);

export default ResumePreview;
