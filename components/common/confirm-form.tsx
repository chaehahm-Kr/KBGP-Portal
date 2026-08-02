"use client";

import React from "react";

interface ConfirmFormProps {
  action: (formData: FormData) => void;
  message: string;
  className?: string;
  children: React.ReactNode;
}

export function ConfirmForm({ action, message, className, children }: ConfirmFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) {
      e.preventDefault();
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
