"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Search box for the monitor index, navigating by URL.
 *
 * A client component rather than a plain `<form action="/monitors">`, which is
 * what this was first: the markup is valid and `form.submit()` navigates
 * correctly, but React owns the submit event and does not let the native GET
 * through, so neither Enter nor the button did anything. Nothing in the console
 * said so — the page simply did not move.
 *
 * Deliberately not debounced-as-you-type. The page is `force-dynamic`, re-reads
 * the database and settles stale analyses on every render, so searching on each
 * keystroke would buy a slightly nicer feel with a write path per character.
 * Enter, or the button, is one navigation per search.
 */
export function MonitorSearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  /**
   * Navigate changing only the key this control owns.
   *
   * Same rule as the Daily page's DayPicker, and for the same reason recorded
   * there: rebuilding the query from scratch silently drops every other param,
   * so a search would throw away the chosen ordering.
   */
  function go(next: string) {
    const p = new URLSearchParams(params.toString());
    const trimmed = next.trim();
    if (trimmed) p.set("q", trimmed);
    else p.delete("q");
    const query = p.toString();
    router.push(query ? `/monitors?${query}` : "/monitors");
    // The push alone changed the address bar and left the list untouched: the
    // client router cache answered the new URL with the entry it already had,
    // so a search read as "nothing matched anything" while the server was
    // never asked. The page is force-dynamic and the filtering happens there,
    // so the refetch has to be explicit.
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="flex items-center gap-1.5"
    >
      <label htmlFor="q" className="text-muted-foreground">
        Search
      </label>
      <input
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="name, id or service"
        className="w-56 rounded-md border border-input bg-background px-2.5 py-1 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
      />
      <Button type="submit" size="sm" variant="secondary" aria-label="Search monitors">
        <SearchIcon className="h-3.5 w-3.5" />
      </Button>
      {/* Only once a search is in the URL, so it clears something that is
          actually applied rather than whatever is half-typed in the field. */}
      {params.get("q") && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </form>
  );
}
