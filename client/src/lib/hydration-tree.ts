import { createElement, Fragment, useEffect, type ReactNode } from "react";

/** Renders nothing; its effect runs once the tree it is part of has committed. */
function OnCommitted({ callback }: { callback: () => void }) {
  useEffect(callback, [callback]);
  return null;
}

/** What client/src/main.tsx hydrates: the app, plus a signal that hydration committed. */
export function hydrationTree(app: ReactNode, onCommitted: () => void) {
  return createElement(Fragment, null, app, createElement(OnCommitted, { callback: onCommitted }));
}
