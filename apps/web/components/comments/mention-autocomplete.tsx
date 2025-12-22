"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface MentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (member: TeamMember) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  query,
  position,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch team members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch("/api/team");
        if (response.ok) {
          const data = await response.json();
          setMembers(data);
        }
      } catch (error) {
        console.error("Failed to fetch team members:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Filter members based on query
  useEffect(() => {
    const filtered = members.filter((member) =>
      member.full_name.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredMembers(filtered.slice(0, 5)); // Limit to 5 results
    setSelectedIndex(0);
  }, [query, members]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && filteredMembers[selectedIndex]) {
        e.preventDefault();
        onSelect(filteredMembers[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filteredMembers, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="absolute z-50 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (filteredMembers.length === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute z-50 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-sm text-muted-foreground">No matches found</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      {filteredMembers.map((member, index) => (
        <button
          key={member.id}
          className={`w-full flex items-center gap-2 p-2 text-left hover:bg-accent ${
            index === selectedIndex ? "bg-accent" : ""
          }`}
          onClick={() => onSelect(member)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(member.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{member.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {member.email}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
