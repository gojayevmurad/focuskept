import { SiteHeader } from "@/src/components/site-header";
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <span className="overline">EDITABLE TEMPLATE</span>
        <h1>Terms of service</h1>
        <p className="notice">
          This is a placeholder. Replace it with a reviewed policy for your
          product and jurisdiction before launch.
        </p>
        <h2>Your product, your policies</h2>
        <p>
          Document your business identity, data processing, subprocessors,
          retention, user rights, contact information, service terms, payments,
          refunds, and applicable law.
        </p>
        <p>This template does not represent legal compliance.</p>
      </main>
    </>
  );
}
