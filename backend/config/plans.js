module.exports = {
  free: {
    id: "free",
    name: "Starter",
    price: 0,
    currency: "USD",
    interval: "month",
    features: {
      reports: false,
      apiAccess: false,
    },
    limits: {
      students: 20,
      feeStructures: 20,
      parentStudents: 20,
      payments: Infinity,
    },
  },
  pro: {
    id: "pro",
    name: "Professional",
    price: 29,
    currency: "USD",
    interval: "month",
    features: {
      reports: true,
      apiAccess: true,
    },
    limits: {
      students: 2000,
      feeStructures: 1000,
      parentStudents: 2000,
      payments: Infinity,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    currency: "USD",
    interval: "month",
    features: {
      reports: true,
      apiAccess: true,
    },
    limits: {
      students: Infinity,
      feeStructures: Infinity,
      parentStudents: Infinity,
      payments: Infinity,
    },
  },
};
