"use client";
import { useSyncExternalStore } from "react";
import { authEpoch, subscribeAuth } from "src/lib/portal/sitecore-auth";

/** Changes when the author signs in with Sitecore inside the app (see sitecore-auth.ts): a dependency
 *  for the effects that load the app's data, so a sign-in shows the data without reopening the app. */
export const useAuthEpoch = () => useSyncExternalStore(subscribeAuth, authEpoch, () => 0);
