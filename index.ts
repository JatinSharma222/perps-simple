import express from "express";

const app = express();
app.use(express.json());

const users = [
  {
    userId: 1,
    username: "harkirat",
    password: 123123,
    collateral: {
      available: 2000,
      locked: 1000,
    },
    positions: [
      {
        market: "SOL",
        type: "LONG",
        qty: 10,
        margin: 500,
        liquidationPrice: 80,
        averagePrice: 90,
      },
      {
        market: "ETH",
        type: "SHORT",
        qty: 1,
        margin: 500,
        liquidationPrice: 2000,
        averagePrice: 1900,
      },
    ],
    orders: [
      {
        orderId: 1,
        market: "SOL",
        type: "LONG",
        qty: 10,
        margin: 500,
        orderType: "limit",
        price: 90,
        status: "filled",
      },
      {
        orderId: 2,
        market: "ETH",
        type: "SHORT",
        qty: 10,
        margin: 500,
        orderType: "limit",
        price: 1900,
        status: "filled",
      },
      {
        orderId: 3,
        market: "BTC",
        type: "LONG",
        qty: 10,
        margin: 500,
        orderType: "limit",
        price: 1900,
        status: "cancelled",
      },
    ],
  },
  {
    userId: 2,
    username: "raman",
    password: 123123,
    collateral: {
      available: 2000,
      locked: 2000,
    },
    positions: [
      {
        market: "SOL",
        type: "SHORT",
        qty: 10,
        margin: 1000,
        liquidationPrice: 80,
        pnL: 200,
        averagePrice: 90,
      },
      {
        market: "ETH",
        type: "LONG",
        qty: 1,
        margin: 1000,
        liquidationPrice: 2000,
        pnL: -100,
        averagePrice: 1900,
      },
    ],
    orders: [
      {
        orderId: 10,
        market: "SOL",
        type: "SHORT",
        qty: 10,
        margin: 500,
        orderType: "market",
        price: 90,
        status: "filled",
      },
      {
        orderId: 11,
        market: "ETH",
        type: "LONG",
        qty: 10,
        margin: 500,
        orderType: "market",
        price: 1900,
        status: "filled",
      },
      {
        orderId: 12,
        market: "ZEC",
        type: "LONG",
        qty: 10,
        margin: 500,
        orderType: "limit",
        price: 1900,
        status: "open",
      },
    ],
  },
];

type Bid = {
  availableQty: number;
  openOrders: {
    userId: number;
    qty: number;
    filledQty: number;
    orderId: number;
    createdAt: Date;
  }[];
};

type Orderbook = {
  bids: Record<string, Bid>;
  asks: Record<string, Bid>;
  lastTradedPrice: number;
  indexPrice: number;
};

type Orderbooks = Record<string, Orderbook>;

const orderbooks: Orderbooks = {
  SOL: { bids: {}, asks: {}, lastTradedPrice: 90, indexPrice: 90.01 },
  ETH: { bids: {}, asks: {}, lastTradedPrice: 1900, indexPrice: 1899.9 },
};

const fills = [
  {
    maker: 1,
    taker: 2,
    market: "SOL",
    qty: 10,
    price: 90,
    long: 1,
    short: 2,
  },
  {
    maker: 1,
    taker: 2,
    market: "ETH",
    qty: 1,
    price: 1900,
    long: 2,
    short: 1,
  },
];

app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }
  const userId = users.length + 1;
  users.push({
    userId,
    username,
    password,
    collateral: { available: 0, locked: 0 },
    positions: [],
    orders: [],
  });
  res.json({ message: "User created successfully", userId });
});
app.post("/signin", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ message: "User signed in successfully", userId: user.userId });
});

app.post("/onramp", (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount) {
    return res.status(400).json({ error: "User ID and amount are required" });
  }
  const user = users.find((u) => u.userId === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  user.collateral.available += amount;
  res.json({
    message: "Funds added successfully",
    availableCollateral: user.collateral.available,
  });
});
app.post("/order", (req, res) => {
  const { userId, market, type, qty, margin, orderType, price } = req.body;
  if (!userId || !market || !type || !qty || !margin || !orderType || !price) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const user = users.find((u) => u.userId === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const book = orderbooks[market];
  if (!book) {
    return res.status(404).json({ error: "Market not found" });
  }

  // Check if user has enough available collateral
  if (user.collateral.available < margin) {
    return res.status(400).json({ error: "Insufficient available collateral" });
  }

  // Deduct margin from user's available collateral and lock it
  user.collateral.available -= margin;
  user.collateral.locked += margin;

  // Create order and add to user's orders
  const orderId = user.orders.length + 1;
  const newOrder = {
    orderId,
    market,
    type,
    qty,
    margin,
    orderType,
    price,
    status: "open",
  };
  user.orders.push(newOrder);

  // Add order to orderbook
  const bidOrAsk = type === "LONG" ? book.bids : book.asks;
  if (!bidOrAsk[price]) {
    bidOrAsk[price] = { availableQty: 0, openOrders: [] };
  }
  bidOrAsk[price].availableQty += qty;
  bidOrAsk[price].openOrders.push({
    userId,
    qty,
    filledQty: 0,
    orderId,
    createdAt: new Date(),
  });

  res.json({ message: "Order placed successfully", orderId });
});

app.delete("/order", (req, res) => {
    const { userId, orderId } = req.body;
    if (!userId || !orderId) {
      return res.status(400).json({ error: "User ID and order ID are required" });
    }
    const user = users.find((u) => u.userId === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const orderIndex = user.orders.findIndex((o) => o.orderId === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = user.orders[orderIndex];
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "open") {
      return res.status(400).json({ error: "Only open orders can be cancelled" });
    }

    // Remove order from user's orders
    user.orders.splice(orderIndex, 1);

    // Remove order from orderbook
    const book = orderbooks[order.market];
    if (!book) {
      return res.status(500).json({ error: "Order book not found" });
    }
    const bidOrAsk = order.type === "LONG" ? book.bids : book.asks;
    const priceLevel = bidOrAsk[order.price];
    if (priceLevel) {
      priceLevel.availableQty -= order.qty;
      priceLevel.openOrders = priceLevel.openOrders.filter((o) => o.orderId !== orderId);
      if (priceLevel.availableQty <= 0) {
        delete bidOrAsk[order.price];
      }
    }

    // Refund margin to user's available collateral
    user.collateral.available += order.margin;
    user.collateral.locked -= order.margin;

    res.json({ message: "Order cancelled successfully" });
});

app.get("/equity/available", (req, res) => {
    const { userId } = req.query;
    const user = users.find((u) => u.userId === Number(userId));
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json({ availableEquity: user.collateral.available });
});

app.get("/positions/open/:marketId", (req, res) => {
    const { marketId } = req.params;
    const openPositions = users.flatMap((u) => u.positions).filter((p: any) => p.market === marketId && p.status === "open");
    res.json({ positions: openPositions });
});

app.get("/positions/closed/:marketId", (req, res) => {
    const { marketId } = req.params;
    const closedPositions = users.flatMap((u) => u.positions).filter((p: any) => p.market === marketId && p.status === "closed");
    res.json({ positions: closedPositions });
});

app.get("/orders/open/:marketId", (req, res) => {
    const { marketId } = req.params;
    const openOrders = users.flatMap((u) => u.orders).filter((o) => o.market === marketId && o.status === "open");
    res.json({ orders: openOrders });
});
app.get("/orders/:marketId", (req, res) => {
    const { marketId } = req.params;
    const orders = users.flatMap((u) => u.orders).filter((o) => o.market === marketId);
    res.json({ orders });
});
app.get("/fills", (req, res) => {
    res.json({ fills: [] });
});

async function liqudationChecks(asset: string, price: number) {

}

async function onPriceUpdateFromBinance(asset: string, price: number) {
  liqudationChecks(asset, price);
}
