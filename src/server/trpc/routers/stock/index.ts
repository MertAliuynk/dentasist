import { router } from "@/server/trpc/trpc";
import { stockCategoryRouter } from "@/server/trpc/routers/stock/category";
import { supplierRouter } from "@/server/trpc/routers/stock/supplier";
import { stockProductRouter } from "@/server/trpc/routers/stock/product";
import { stockMovementRouter } from "@/server/trpc/routers/stock/movement";

export const stockRouter = router({
  category: stockCategoryRouter,
  supplier: supplierRouter,
  product: stockProductRouter,
  movement: stockMovementRouter,
});
