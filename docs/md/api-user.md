# client.user

> Account profile, region discovery, and orders.

Account profile, region, and order endpoints.

Accessed as `client.user`. These endpoints require a user context and are
therefore unavailable to third-party business tokens.

See: https://developer.tesla.com/docs/fleet-api/endpoints/user-endpoints

## Methods

### `me`

```ts
me(options?: RequestOverrides): Promise<UserProfile>
```


### `region`

```ts
region(options?: RequestOverrides): Promise<UserRegion>
```

Returns the region serving this account and its Fleet API base URL.

Authoritative, and preferable to inferring a region from a country code
with regionForCountry. Takes no parameters: the result is derived
from the token subject.


### `featureConfig`

```ts
featureConfig(options?: RequestOverrides): Promise<Record<string, unknown>>
```


### `orders`

```ts
orders(options?: RequestOverrides): Promise<Order[]>
```


