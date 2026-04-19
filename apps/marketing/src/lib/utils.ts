import clsx, { ClassValue } from 'clsx'

export function cn(...classes: ClassValue[]): string {
  return clsx(classes)
}
