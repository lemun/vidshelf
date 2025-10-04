import { useState, type FormEvent } from "react";

const Search: React.FC = () => {
    const [query, setQuery] = useState("");
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // TODO: Implement search
        console.log(query);
    }
    return (
      <form className="flex-1 flex items-center justify-center" onSubmit={handleSubmit}>
      <div className="w-full max-w-2xl flex">
        <input
          placeholder="Search"
          className="flex-1 h-10 border border-neutral-300 rounded-l-full px-4 outline-none focus:border-neutral-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="h-10 px-5 border border-neutral-300 border-l-0 rounded-r-full bg-neutral-100 hover:bg-neutral-200"
          aria-label="Search"
          onClick={handleSubmit}
        >
          Search
        </button>
      </div>
    </form>
    )
}

export default Search;
