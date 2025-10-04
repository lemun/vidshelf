// Simple mock data for the homepage

export type Video = {
    id: string;
    title: string;
    channel: string;
    views: string;   // e.g., "1.2M views"
    age: string;     // e.g., "3 days ago"
    duration: string; // e.g., "12:34"
    thumbnail: string;
    avatar: string;
  };

  export const categories: string[] = [
    "All",
    "Music",
    "Gaming",
    "News",
    "Live",
    "Podcasts",
    "Mixes",
    "Recently uploaded",
    "Watched",
    "New to you",
  ];

  export const videos: Video[] = [
    {
      id: "v1",
      title: "Relaxing Lofi Beats to Code/Study",
      channel: "Lofi Station",
      views: "1.2M views",
      age: "3 days ago",
      duration: "2:31:45",
      thumbnail: "https://picsum.photos/seed/yt1/640/360",
      avatar: "https://i.pravatar.cc/48?img=10",
    },
    {
      id: "v2",
      title: "TypeScript Crash Course (Beginner Friendly)",
      channel: "CodeLab",
      views: "987K views",
      age: "1 week ago",
      duration: "43:12",
      thumbnail: "https://picsum.photos/seed/yt2/640/360",
      avatar: "https://i.pravatar.cc/48?img=5",
    },
    {
      id: "v3",
      title: "Insane Bike Tricks in the City",
      channel: "Urban Riders",
      views: "2.5M views",
      age: "2 weeks ago",
      duration: "8:02",
      thumbnail: "https://picsum.photos/seed/yt3/640/360",
      avatar: "https://i.pravatar.cc/48?img=22",
    },
    {
      id: "v4",
      title: "Daily Tech News — What’s New This Week",
      channel: "TechNow",
      views: "312K views",
      age: "5 hours ago",
      duration: "15:27",
      thumbnail: "https://picsum.photos/seed/yt4/640/360",
      avatar: "https://i.pravatar.cc/48?img=7",
    },
    {
      id: "v5",
      title: "How to Cook the Perfect Steak at Home",
      channel: "Kitchen Basics",
      views: "1.9M views",
      age: "1 month ago",
      duration: "9:41",
      thumbnail: "https://picsum.photos/seed/yt5/640/360",
      avatar: "https://i.pravatar.cc/48?img=12",
    },
    {
      id: "v6",
      title: "24H with a Startup Founder",
      channel: "Build & Learn",
      views: "221K views",
      age: "2 days ago",
      duration: "18:05",
      thumbnail: "https://picsum.photos/seed/yt6/640/360",
      avatar: "https://i.pravatar.cc/48?img=30",
    },
    {
      id: "v7",
      title: "React Query Explained in 10 Minutes",
      channel: "Dev Quickies",
      views: "451K views",
      age: "3 weeks ago",
      duration: "10:12",
      thumbnail: "https://picsum.photos/seed/yt7/640/360",
      avatar: "https://i.pravatar.cc/48?img=20",
    },
    {
      id: "v8",
      title: "Morning Yoga Routine for Beginners",
      channel: "Move Daily",
      views: "823K views",
      age: "6 days ago",
      duration: "12:52",
      thumbnail: "https://picsum.photos/seed/yt8/640/360",
      avatar: "https://i.pravatar.cc/48?img=28",
    },
    {
      id: "v9",
      title: "Budget PC Build That Surprised Me",
      channel: "Tech Builder",
      views: "1.1M views",
      age: "4 days ago",
      duration: "16:09",
      thumbnail: "https://picsum.photos/seed/yt9/640/360",
      avatar: "https://i.pravatar.cc/48?img=15",
    },
    {
      id: "v10",
      title: "The Psychology of High Performance",
      channel: "Mindset Lab",
      views: "602K views",
      age: "2 months ago",
      duration: "21:33",
      thumbnail: "https://picsum.photos/seed/yt10/640/360",
      avatar: "https://i.pravatar.cc/48?img=11",
    },
    {
      id: "v11",
      title: "NestJS Auth in 15 Minutes",
      channel: "API Craft",
      views: "390K views",
      age: "1 week ago",
      duration: "14:58",
      thumbnail: "https://picsum.photos/seed/yt11/640/360",
      avatar: "https://i.pravatar.cc/48?img=3",
    },
    {
      id: "v12",
      title: "Top 10 Hidden Beaches",
      channel: "Travel Daily",
      views: "2.1M views",
      age: "3 months ago",
      duration: "11:21",
      thumbnail: "https://picsum.photos/seed/yt12/640/360",
      avatar: "https://i.pravatar.cc/48?img=6",
    },
  ];
