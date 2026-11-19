import ShopOrderGrid from './ShopOrderGrid'
import ShopPushSubscribeButton from './ShopPushSubscribeButton'

// A small opt-in control at the top of the existing staff order screen.
// Does not change ordering or confirmation UI.
export default function ShopOrderPage() {
  return <>
    <ShopPushSubscribeButton />
    <ShopOrderGrid />
  </>
}
