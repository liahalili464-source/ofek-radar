"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle(){
  const { theme, setTheme } = useTheme();
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  if(!ready) return <button className="theme-toggle">◐</button>;
  const dark=theme==="dark";
  return <button className="theme-toggle" onClick={()=>setTheme(dark?"light":"dark")} aria-label="החלפת ערכת נושא">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
}
