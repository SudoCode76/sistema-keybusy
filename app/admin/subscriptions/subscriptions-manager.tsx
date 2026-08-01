"use client"

import { useState } from "react"

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { SaleDialog } from "./sale-dialog"
import type {
  AccountOption,
  CountryOption,
  ProductOption,
  ProviderOption,
  ReleasedSpotifyAccessOption,
} from "./sale-form"
import { SubscriptionsTable, type SubscriptionRow } from "./subscriptions-table"

export function SubscriptionsManager({
  accounts,
  releasedSpotifyAccesses,
  countries,
  defaultCountryId,
  initialActiveTotal,
  initialRows,
  initialTotal,
  platforms,
  products,
  providers,
}: {
  accounts: AccountOption[]
  releasedSpotifyAccesses: ReleasedSpotifyAccessOption[]
  countries: CountryOption[]
  defaultCountryId?: string
  initialActiveTotal: number
  initialRows: SubscriptionRow[]
  initialTotal: number
  platforms: { slug: string; name: string }[]
  products: ProductOption[]
  providers: ProviderOption[]
}) {
  const [platform, setPlatform] = useState("all")
  const defaultProductSlug =
    platform === "all"
      ? products[0]?.slug
      : (products.find(
          (product) => product.serviceSlug === platform && product.isDefault
        ) ?? products.find((product) => product.serviceSlug === platform))?.slug

  return (
    <>
      <CardHeader className="min-w-0 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Accesos</CardTitle>
          <CardDescription>
            Activos, vencidos y pendientes de renovar.
          </CardDescription>
        </div>
        <SaleDialog
          accounts={accounts}
          countries={countries}
          defaultCountryId={defaultCountryId}
          defaultProductSlug={defaultProductSlug}
          key={`${platform}:${defaultProductSlug ?? ""}`}
          products={products}
          providers={providers}
          releasedSpotifyAccesses={releasedSpotifyAccesses}
        />
      </CardHeader>
      <CardContent className="min-w-0">
        <SubscriptionsTable
          accounts={accounts}
          countries={countries}
          defaultCountryId={defaultCountryId}
          initialActiveTotal={initialActiveTotal}
          initialRows={initialRows}
          initialTotal={initialTotal}
          onPlatformChange={setPlatform}
          platform={platform}
          platforms={platforms}
          products={products}
          providers={providers}
        />
      </CardContent>
    </>
  )
}
