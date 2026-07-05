export default function MediaCardGrid({ children }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:[grid-template-columns:repeat(auto-fill,minmax(160px,180px))]">
      {children}
    </div>
  );
}
