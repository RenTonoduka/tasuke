declare module 'd3-flextree' {
  interface FlextreeNode<T> {
    data: T;
    x: number;
    y: number;
    depth: number;
    height: number;
    parent: FlextreeNode<T> | null;
    children: FlextreeNode<T>[] | undefined;
    each(callback: (node: FlextreeNode<T>) => void): void;
    eachBefore(callback: (node: FlextreeNode<T>) => void): void;
    eachAfter(callback: (node: FlextreeNode<T>) => void): void;
  }

  interface FlextreeLayout<T> {
    (root: FlextreeNode<T>): FlextreeNode<T>;
    hierarchy(data: T, children?: (d: T) => T[] | undefined): FlextreeNode<T>;
    nodeSize(): ((node: FlextreeNode<T>) => [number, number]) | undefined;
    nodeSize(size: (node: FlextreeNode<T>) => [number, number]): FlextreeLayout<T>;
    spacing(): ((a: FlextreeNode<T>, b: FlextreeNode<T>) => number) | undefined;
    spacing(spacing: (a: FlextreeNode<T>, b: FlextreeNode<T>) => number): FlextreeLayout<T>;
  }

  export function flextree<T>(options?: {
    nodeSize?: (node: FlextreeNode<T>) => [number, number];
    spacing?: (a: FlextreeNode<T>, b: FlextreeNode<T>) => number;
  }): FlextreeLayout<T>;
}
