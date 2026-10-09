
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  History,
  PackagePlus,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, RequirePermission } from "@/components/app/PageKit";

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity_on_hand: number;
  reorder_level: number;
  unit: string;
  unit_cost: number | null;
  created_at: string;
  updated_at: string;
};

type InventoryTransaction = {
  id: string;
  item_id: string;
  quantity: number;
  transaction_type: string;
  occurred_at: string;
  notes: string | null;
  reference: string | null;
  unit_cost: number | null;
};

const emptyItem = {
  name: "",
  sku: "",
  category: "Feed",
  unit: "kg",
  quantity_on_hand: "0",
  reorder_level: "5",
  unit_cost: "0",
};

const categories = [
  "Feed",
  "Medicine",
  "Vaccines",
  "Supplements",
  "Equipment",
  "Cleaning supplies",
  "Other",
];

function InventoryContent() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("inventory.manage");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemDialog, setItemDialog] = useState(false);
  const [movementDialog, setMovementDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [movementType, setMovementType] = useState("received");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [actualCount, setActualCount] = useState("");
  const [movementCost, setMovementCost] = useState("");
  const [movementReference, setMovementReference] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [itemForm, setItemForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name");

      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["inventory-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as InventoryTransaction[];
    },
  });

  const items = itemsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  const lowStockItems = items.filter(
    (item) => item.quantity_on_hand <= item.reorder_level,
  );

  const totalValue = items.reduce(
    (total, item) =>
      total + item.quantity_on_hand * (item.unit_cost ?? 0),
    0,
  );

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();

    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.sku ?? "").toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  function openNewItem() {
    setEditingItem(null);
    setItemForm(emptyItem);
    setItemDialog(true);
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku ?? "",
      category: item.category ?? "Other",
      unit: item.unit,
      quantity_on_hand: String(item.quantity_on_hand),
      reorder_level: String(item.reorder_level),
      unit_cost: String(item.unit_cost ?? 0),
    });
    setItemDialog(true);
  }

  function openMovement(item?: InventoryItem) {
    setSelectedItemId(item?.id ?? items[0]?.id ?? "");
    setMovementType("received");
    setMovementQuantity("");
    setActualCount("");
    setMovementCost("");
    setMovementReference("");
    setMovementNotes("");
    setMovementDialog(true);
  }

  async function saveItem() {
    if (!canManage) {
      alert("You do not have permission to manage inventory.");
      return;
    }

    if (!itemForm.name.trim() || !itemForm.unit.trim()) {
      alert("Enter an item name and unit.");
      return;
    }

    const quantity = Number(itemForm.quantity_on_hand);
    const reorder = Number(itemForm.reorder_level);
    const cost = Number(itemForm.unit_cost);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(reorder) ||
      !Number.isFinite(cost) ||
      quantity < 0 ||
      reorder < 0 ||
      cost < 0
    ) {
      alert("Quantity, reorder level and cost must be valid non-negative numbers.");
      return;
    }

    setSaving(true);

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update({
            name: itemForm.name.trim(),
            sku: itemForm.sku.trim() || null,
            category: itemForm.category,
            unit: itemForm.unit.trim(),
            reorder_level: reorder,
            unit_cost: cost,
          })
          .eq("id", editingItem.id);

        if (error) throw error;

        // Opening stock is changed through stock movements, not item editing.
      } else {
        const { error } = await supabase.from("inventory_items").insert({
          name: itemForm.name.trim(),
          sku: itemForm.sku.trim() || null,
          category: itemForm.category,
          unit: itemForm.unit.trim(),
          quantity_on_hand: quantity,
          reorder_level: reorder,
          unit_cost: cost,
        });

        if (error) throw error;
      }

      setItemDialog(false);
      await queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save inventory item.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement() {
    if (!canManage) {
      alert("You do not have permission to manage inventory.");
      return;
    }

    const item = items.find((entry) => entry.id === selectedItemId);

    if (!item) {
      alert("Select an inventory item.");
      return;
    }

    const enteredQuantity = Number(movementQuantity);
    const enteredCount = Number(actualCount);

    if (movementType === "count") {
      if (
        actualCount.trim() === "" ||
        !Number.isFinite(enteredCount) ||
        enteredCount < 0
      ) {
        alert("Enter a valid physical stock count.");
        return;
      }
    } else if (
      !movementQuantity.trim() ||
      !Number.isFinite(enteredQuantity) ||
      enteredQuantity <= 0
    ) {
      alert("Enter a quantity greater than zero.");
      return;
    }

    const newQuantity =
      movementType === "received"
        ? item.quantity_on_hand + enteredQuantity
        : movementType === "used"
          ? item.quantity_on_hand - enteredQuantity
          : enteredCount;

    if (newQuantity < 0) {
      alert("There is not enough stock for this usage.");
      return;
    }

    const difference = newQuantity - item.quantity_on_hand;

    if (movementType === "count" && difference === 0) {
      alert("The physical count matches the recorded stock. No adjustment is needed.");
      return;
    }

    let transactionType = movementType;
    if (movementType === "count") {
      transactionType = difference > 0 ? "count_increase" : "count_decrease";
    }

    const transactionQuantity =
      movementType === "count" ? Math.abs(difference) : enteredQuantity;

    const enteredCost = movementCost.trim() === "" ? null : Number(movementCost);

    if (
      enteredCost !== null &&
      (!Number.isFinite(enteredCost) || enteredCost < 0)
    ) {
      alert("Enter a valid unit cost.");
      return;
    }

    setSaving(true);

    try {
      // Update the stock quantity first.
      const updateData: {
        quantity_on_hand: number;
        updated_at: string;
        unit_cost?: number;
      } = {
        quantity_on_hand: newQuantity,
        updated_at: new Date().toISOString(),
      };

      if (movementType === "received" && enteredCost !== null) {
        updateData.unit_cost = enteredCost;
      }

      const { error: updateError } = await supabase
        .from("inventory_items")
        .update(updateData)
        .eq("id", item.id);

      if (updateError) throw updateError;

      // Record the movement in the audit history.
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          item_id: item.id,
          quantity: transactionQuantity,
          transaction_type: transactionType,
          occurred_at: new Date().toISOString(),
          performed_by: user?.id ?? null,
          unit_cost: enteredCost,
          reference: movementReference.trim() || null,
          notes:
            movementType === "count"
              ? `Physical count: ${enteredCount} ${item.unit}. ${movementNotes.trim()}`.trim()
              : movementNotes.trim() || null,
        });

      if (transactionError) {
        throw new Error(
          `Stock quantity was updated, but the movement history could not be saved. Refresh and contact an administrator before retrying. Details: ${transactionError.message}`,
        );
      }

      setMovementDialog(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] }),
      ]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not record stock movement.");
      await queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = items.find((item) => item.id === selectedItemId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage animal feed, medicines, vaccines and farm supplies."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openMovement()}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Stock movement
              </Button>
              <Button onClick={openNewItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            </div>
          ) : undefined
        }
      />

      {(itemsQuery.isError || transactionsQuery.isError) && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Inventory data could not be loaded. Check your connection and database permissions, then refresh the page.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Stock items</span>
            <Boxes className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{items.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Different inventory items</p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Low-stock alerts</span>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{lowStockItems.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">At or below reorder level</p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Inventory value</span>
            <PackagePlus className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatNaira(totalValue)}</div>
          <p className="mt-1 text-xs text-muted-foreground">Based on recorded unit costs</p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Recent movements</span>
            <History className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{transactions.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Latest 100 recorded movements</p>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Reorder alerts
          </h2>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Available: {item.quantity_on_hand} {item.unit} · Reorder at:{" "}
                    {item.reorder_level} {item.unit}
                  </p>
                </div>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => openMovement(item)}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Record stock
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search item name or SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Quantity</th>
                <th className="p-3 font-medium">Reorder level</th>
                <th className="p-3 font-medium">Unit cost</th>
                <th className="p-3 font-medium">Stock value</th>
                {canManage && <th className="p-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {itemsQuery.isLoading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-8 text-center text-muted-foreground">
                    Loading inventory...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-8 text-center">
                    <Boxes className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No inventory items found</p>
                    <p className="mt-1 text-muted-foreground">
                      {items.length === 0
                        ? "Add your first feed, medicine or farm supply to get started."
                        : "Try a different search or category."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const low = item.quantity_on_hand <= item.reorder_level;

                  return (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{item.name}</p>
                        {item.sku && (
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        )}
                      </td>
                      <td className="p-3">{item.category ?? "Other"}</td>
                      <td className="p-3">
                        <span className={low ? "font-semibold text-amber-600" : ""}>
                          {item.quantity_on_hand} {item.unit}
                        </span>
                      </td>
                      <td className="p-3">{item.reorder_level} {item.unit}</td>
                      <td className="p-3">{formatNaira(item.unit_cost ?? 0)}</td>
                      <td className="p-3">
                        {formatNaira(item.quantity_on_hand * (item.unit_cost ?? 0))}
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditItem(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openMovement(item)}
                            >
                              Move stock
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <History className="h-5 w-5" />
          <div>
            <h2 className="font-semibold">Stock movement history</h2>
            <p className="text-sm text-muted-foreground">
              Receipts, usage and physical stock adjustments.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium">Movement</th>
                <th className="p-3 font-medium">Quantity</th>
                <th className="p-3 font-medium">Reference / notes</th>
              </tr>
            </thead>
            <tbody>
              {transactionsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Loading movement history...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const item = items.find((entry) => entry.id === transaction.item_id);
                  const received = transaction.transaction_type === "received" ||
                    transaction.transaction_type === "count_increase";

                  return (
                    <tr key={transaction.id} className="border-t">
                      <td className="whitespace-nowrap p-3">
                        {new Date(transaction.occurred_at).toLocaleString()}
                      </td>
                      <td className="p-3">{item?.name ?? "Unknown item"}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1">
                          {received ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          {transaction.transaction_type.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        {transaction.quantity} {item?.unit ?? ""}
                      </td>
                      <td className="max-w-xs p-3">
                        <div>{transaction.reference || "—"}</div>
                        {transaction.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {transaction.notes}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit inventory item" : "Add inventory item"}</DialogTitle>
            <DialogDescription>
              Enter the details for a feed, medicine or other farm supply.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item name *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="e.g. Broiler starter feed"
              />
            </div>

            <div className="space-y-2">
              <Label>SKU / item code</Label>
              <Input
                value={itemForm.sku}
                onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={itemForm.category}
                  onValueChange={(value) => setItemForm({ ...itemForm, category: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Input
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="kg, litre, bottle, bag"
                />
              </div>
            </div>

            {!editingItem && (
              <div className="space-y-2">
                <Label>Opening quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={itemForm.quantity_on_hand}
                  onChange={(e) => setItemForm({ ...itemForm, quantity_on_hand: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  This is the initial stock. Later changes should be recorded as movements.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Reorder level</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={itemForm.reorder_level}
                  onChange={(e) => setItemForm({ ...itemForm, reorder_level: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit cost (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={itemForm.unit_cost}
                  onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button disabled={saving} onClick={saveItem}>
              {saving ? "Saving..." : editingItem ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movementDialog} onOpenChange={setMovementDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record stock movement</DialogTitle>
            <DialogDescription>
              Record stock received, stock used or a physical stock count.
            </DialogDescription>
          </DialogHeader>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add an inventory item before recording a movement.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Inventory item</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} — {item.quantity_on_hand} {item.unit} available
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedItem && (
                  <p className="text-xs text-muted-foreground">
                    Current stock: {selectedItem.quantity_on_hand} {selectedItem.unit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Movement type</Label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Stock received</SelectItem>
                    <SelectItem value="used">Stock used</SelectItem>
                    <SelectItem value="count">Physical stock count</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {movementType === "count" ? (
                <div className="space-y-2">
                  <Label>Actual quantity counted ({selectedItem?.unit ?? "units"})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={actualCount}
                    onChange={(e) => setActualCount(e.target.value)}
                    placeholder="Enter the quantity physically counted"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Quantity ({selectedItem?.unit ?? "units"})</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={movementQuantity}
                    onChange={(e) => setMovementQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>
              )}

              {movementType === "received" && (
                <div className="space-y-2">
                  <Label>Unit cost for this receipt (₦, optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={movementCost}
                    onChange={(e) => setMovementCost(e.target.value)}
                    placeholder="Cost per unit"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Reference / invoice number</Label>
                <Input
                  value={movementReference}
                  onChange={(e) => setMovementReference(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  placeholder="Supplier, reason for use, stock discrepancy..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementDialog(false)}>Cancel</Button>
            <Button disabled={saving || items.length === 0} onClick={saveMovement}>
              {saving ? "Saving..." : "Save movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RequirePermission perm="inventory.view">
      <InventoryContent />
    </RequirePermission>
  );
}

