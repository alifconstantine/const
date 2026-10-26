"use client";
import React from "react";
import { motion } from "framer-motion";

export function ScrollTextReveal({
  text,
  className = "",
  wordClassName = "",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
}) {
  const words = text.split(" ");
  return (
    <motion.span
      className={`inline-block ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ staggerChildren: 0.015, delayChildren: 0.04 }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className={`inline-block mr-[0.26em] ${wordClassName}`}
          variants={{
            hidden: {
              opacity: 0.12,
              y: 10,
              filter: "blur(5px)",
            },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: {
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              },
            },
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function HeadingReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
