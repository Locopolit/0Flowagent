import React from "react";
import "./SiriOrb.css";

export default function SiriOrb({ size = 28, active = true }) {
  return (
    <div className={`siri-orb ${active ? "siri-orb--active" : ""}`} style={{ width: size, height: size }}>
      <div className="siri-orb__core" />
      <div className="siri-orb__ring siri-orb__ring--1" />
      <div className="siri-orb__ring siri-orb__ring--2" />
      <div className="siri-orb__ring siri-orb__ring--3" />
      <div className="siri-orb__glow" />
    </div>
  );
}
