import type { Taxonomy } from '~~/shared/types/market'
// Import direct : Nitro inline le JSON dans le bundle serveur.
// Pas de lecture disque à runtime → marche aussi dans l'image Docker.
import raw from '../data/taxonomy.json'

let cached: Taxonomy | null = null

export function loadTaxonomy(): Taxonomy {
  if (cached) return cached
  const { categories, assets } = raw as Taxonomy & { $comment?: string }
  cached = { categories, assets }
  return cached
}
