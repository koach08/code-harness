interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: string;
}

export function PlaceholderView({ title, description, icon }: PlaceholderViewProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-white/30">
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      <h2 className="text-lg font-medium text-white/50 mb-2">{title}</h2>
      <p className="text-sm text-white/25 max-w-md text-center">{description}</p>
      <div className="mt-6 px-4 py-2 rounded-lg border border-white/10 text-xs text-white/20">
        Coming soon
      </div>
    </div>
  );
}
