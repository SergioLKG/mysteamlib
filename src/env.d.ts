/// <reference types="astro/client" />

interface LocalsUser {
  userId: string;
  steamId: string;
}

declare namespace App {
  interface Locals {
    user?: LocalsUser | null;
  }
}
