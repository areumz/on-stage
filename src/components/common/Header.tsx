import TabToggle from "./TabToggle";

export default function Header({ dark = false }: { dark?: boolean }) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-6 rounded-md bg-brand" />
        <span className={`font-bold tracking-wide ${dark ? "text-white" : "text-gray-900"}`}>
          STAGE.ONE
        </span>
      </div>
      <TabToggle dark={dark} />
    </header>
  );
}
