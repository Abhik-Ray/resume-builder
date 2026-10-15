import type { ReactNode } from "react";

// Stand-ins for @react-pdf/renderer so PDF layouts render as plain DOM in jsdom.
// Use with: vi.mock("@react-pdf/renderer", () => import("<path>/test/reactPdfMock"))
interface Props {
  children?: ReactNode;
}

export const Document = ({ children, title, author }: Props & { title?: string; author?: string }) => (
  <div data-testid="pdf-document" data-title={title} data-author={author}>
    {children}
  </div>
);
export const Page = ({ children, size }: Props & { size?: string }) => (
  <div data-testid="pdf-page" data-size={size}>
    {children}
  </div>
);
export const View = ({ children }: Props) => <div>{children}</div>;
export const Text = ({ children }: Props) => <p>{children}</p>;
export const PDFViewer = ({ children, className }: Props & { className?: string }) => (
  <div data-testid="pdf-viewer" className={className}>
    {children}
  </div>
);
export const StyleSheet = { create: <T,>(styles: T) => styles };
