import Header from "./components/Header/Header";
import { categories, videos, type Video } from "./mockData";

function Sidebar() {
  const Item = ({ label }: { label: string }) => (
    <button className="w-full flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-neutral-100 text-sm">
      <div className="size-6 rounded bg-neutral-300" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="fixed top-14 left-0 w-60 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-neutral-200 bg-white p-2">
      <div className="space-y-1">
        <Item label="Home" />
        <Item label="Shorts" />
        <Item label="Subscriptions" />
      </div>

      <div className="h-px bg-neutral-200 my-3" />

      <div className="space-y-1">
        <Item label="You" />
        <Item label="History" />
        <Item label="Watch later" />
        <Item label="Playlists" />
      </div>
    </aside>
  );
}

function CategoryBar() {
  return (
    <div className="sticky top-14 z-40 bg-white border-b border-neutral-200">
      <div className="pl-60" />
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {categories.map((c) => (
            <button
              key={c}
              className="px-3 py-1.5 rounded-lg text-sm whitespace-nowrap bg-neutral-100 hover:bg-neutral-200"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ v }: { v: Video }) {
  return (
    <article className="cursor-pointer">
      <div className="relative">
        <img
          src={v.thumbnail}
          alt={v.title}
          className="w-full aspect-video object-cover rounded-xl bg-neutral-200"
          loading="lazy"
        />
        <span className="absolute bottom-2 right-2 text-xs font-medium bg-black/80 text-white px-1.5 py-0.5 rounded">
          {v.duration}
        </span>
      </div>

      <div className="mt-3 flex gap-3">
        <img
          src={v.avatar}
          alt={v.channel}
          className="size-9 rounded-full bg-neutral-300"
          loading="lazy"
        />
        <div>
          <h3 className="text-sm font-medium leading-snug line-clamp-2">
            {v.title}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">{v.channel}</p>
          <p className="text-xs text-neutral-500">
            {v.views} • {v.age}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header />
      <Sidebar />
      <CategoryBar />

      {/* Content */}
      <main className="pt-14 pl-60">
        <div className="px-4 py-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {videos.map((v) => (
              <VideoCard key={v.id} v={v} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
