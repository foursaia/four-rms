'use client';

import React from 'react';
import { RestaurantTable, useReceptionStore } from '@/stores/useReceptionStore';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Users, Utensils, AlertCircle, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface FloorMapProps {
  onTableClick: (table: RestaurantTable) => void;
}

export function FloorMap({ onTableClick }: FloorMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { tables, orders, fetchTables, updateTablePosition, addTable, removeTable, updateTableStatus } = useReceptionStore();
  const [loading, setLoading] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isMergeMode, setIsMergeMode] = React.useState(false);
  const [selectedForMerge, setSelectedForMerge] = React.useState<string[]>([]);

  const handleMergeTables = async () => {
    if (selectedForMerge.length < 2) return;
    
    // Find any existing order attached to these tables
    const tablesToMerge = tables.filter(t => selectedForMerge.includes(t.table_number));
    const existingOrderTable = tablesToMerge.find(t => t.current_order_id);
    const orderIdToLink = existingOrderTable?.current_order_id;

    try {
      // Mark all selected tables as occupied and link to the order if it exists
      for (const table of tablesToMerge) {
        await updateTableStatus(table.id, 'occupied', orderIdToLink || null);
      }

      setSelectedForMerge([]);
      setIsMergeMode(false);
      alert(orderIdToLink 
        ? `Tables merged and linked to Order ID: ${orderIdToLink}` 
        : "Tables merged as occupied groups."
      );
    } catch (err: any) {
      alert("Error merging tables: " + err.message);
    }
  };

  const toggleTableSelection = (id: string) => {
    setSelectedForMerge(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const loadTablesViaApi = async () => {
    const { data: branches } = await supabase.from('branches').select('id').limit(1);
    if (!branches?.[0]) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/seed-tables?branchId=${branches[0].id}`);
      const result = await response.json();
      if (result.tables) {
        useReceptionStore.setState({ tables: result.tables });
      }
    } catch (err) {
      console.error("API Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadTablesViaApi();
  }, []);

  const handleSeedTables = async () => {
    const { data: branches } = await supabase.from('branches').select('id').limit(1);
    if (!branches?.[0]) return alert("No branch found");

    const branchId = branches[0].id;
    
    try {
      const response = await fetch('/api/seed-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      fetchTables(branchId);
    } catch (err: any) {
      alert("Error seeding: " + err.message);
    }
  };

  const handleAddTable = async () => {
    const { data: branches } = await supabase.from('branches').select('id').limit(1);
    if (!branches?.[0]) return;
    const newNumber = `T${tables.length + 1}`;
    await addTable(branches[0].id, newNumber, 4);
  };

  const handleRemoveTable = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm("Are you sure you want to remove this table?")) {
      await removeTable(id);
    }
  };

  const getTableOrder = (table: RestaurantTable) => {
    if (!table.current_order_id) return null;
    return orders.find(o => o.id === table.current_order_id && o.status !== 'delivered' && o.status !== 'cancelled');
  };

  return (
    <div className="relative w-full h-[600px] bg-background/50 rounded-[40px] border border-border overflow-hidden p-8 shadow-inner">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} 
      />

      {/* Admin Controls */}
      <div className="absolute top-6 right-6 z-50 flex gap-4">
        {isMergeMode ? (
          <>
            <Button 
              onClick={handleMergeTables} 
              disabled={selectedForMerge.length < 2}
              variant="primary" 
              className="bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg font-black"
            >
              CONFIRM MERGE ({selectedForMerge.length})
            </Button>
            <Button 
              onClick={() => { setIsMergeMode(false); setSelectedForMerge([]); }} 
              variant="outline" 
              className="bg-surface/80 backdrop-blur-md rounded-xl"
            >
              CANCEL
            </Button>
          </>
        ) : (
          <>
            {!isEditMode && (
              <Button 
                onClick={() => setIsMergeMode(true)} 
                variant="outline" 
                className="bg-surface/80 backdrop-blur-md rounded-xl font-black gap-2"
              >
                <Utensils size={16} />
                MERGE TABLES
              </Button>
            )}
            {isEditMode && (
              <Button onClick={handleAddTable} variant="primary" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg">
                <Plus size={16} className="mr-2" /> Add Table
              </Button>
            )}
            <Button 
              onClick={() => setIsEditMode(!isEditMode)} 
              variant={isEditMode ? "primary" : "outline"}
              className={cn("rounded-xl font-black shadow-lg transition-all", isEditMode ? "bg-primary text-background" : "bg-surface/80 backdrop-blur-md")}
            >
              {isEditMode ? "SAVE LAYOUT" : "EDIT LAYOUT"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted font-black uppercase tracking-widest text-xs">Loading Floor Plan...</p>
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full h-full">
          {tables.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <AlertCircle size={48} className="mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs mb-4">No Tables Configured</p>
              <Button 
                onClick={handleSeedTables}
                variant="outline" 
                className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10"
              >
                <Plus size={16} className="mr-2" />
                Initialize 12 Sample Tables
              </Button>
            </div>
          ) : (
            tables.map((table, index) => {
              const activeOrder = getTableOrder(table);
              const isOccupied = table.status === 'occupied';

              // Fallback initial position if 0,0 to prevent stacking on first load
              const currentX = table.position_x || (index % 6) * 140 + 20;
              const currentY = table.position_y || Math.floor(index / 6) * 140 + 20;

              return (
                <motion.div
                  key={table.id}
                  drag={isEditMode}
                  dragConstraints={containerRef}
                  dragElastic={0.1}
                  dragMomentum={false}
                  animate={{ x: currentX, y: currentY }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ position: 'absolute', width: '110px', height: '110px' }}
                  onDragEnd={(e, info) => {
                    updateTablePosition(table.id, Math.max(0, currentX + info.offset.x), Math.max(0, currentY + info.offset.y));
                  }}
                  className={cn(
                    "rounded-3xl border-2 flex flex-col items-center justify-center transition-colors duration-500 group",
                    selectedForMerge.includes(table.table_number)
                      ? "bg-blue-500/20 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                      : isOccupied 
                        ? "bg-red-500/10 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]" 
                        : "bg-emerald-500/10 border-emerald-500/30",
                    isEditMode ? "cursor-grab active:cursor-grabbing border-dashed border-primary shadow-xl z-40 bg-surface/80 backdrop-blur-sm" : 
                    isMergeMode ? "cursor-pointer border-blue-500/50 hover:bg-blue-500/10" : "cursor-pointer hover:border-emerald-500/60"
                  )}
                  onClick={() => {
                    if (isMergeMode) {
                      toggleTableSelection(table.table_number);
                    } else if (!isEditMode) {
                      onTableClick(table);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isEditMode) {
                      updateTableStatus(table.id, table.status === 'occupied' ? 'available' : 'occupied');
                    }
                  }}
                >
                  {isEditMode && (
                    <button 
                      onClick={(e) => handleRemoveTable(e, table.id)}
                      className="absolute -top-3 -right-3 bg-red-500 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform z-50 border-2 border-background"
                    >
                      <Plus size={16} className="rotate-45" />
                    </button>
                  )}

                  {/* Capacity Dots */}
                  <div className="absolute top-3 flex gap-1">
                    {Array.from({ length: table.capacity }).map((_, i) => (
                      <div key={i} className={cn(
                        "w-1 h-1 rounded-full",
                        isOccupied ? "bg-red-500/40" : "bg-emerald-500/40"
                      )} />
                    ))}
                  </div>

                  <Utensils 
                    size={24} 
                    className={cn(
                      "mb-2 transition-colors",
                      isOccupied ? "text-red-500" : "text-emerald-500"
                    )} 
                  />
                  
                  <span className="text-xl font-black text-white">#{table.table_number}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter opacity-50 text-white mt-1">
                    {isOccupied ? "Occupied" : "Available"}
                  </span>

                  {/* Pulse Effect for Occupied Tables */}
                  {!isEditMode && isOccupied && (
                    <div className="absolute inset-0 rounded-3xl animate-pulse bg-red-500/5" />
                  )}

                  {/* Quick Info Badge */}
                  {!isEditMode && activeOrder && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-background px-2 py-1 rounded-lg text-[10px] font-black shadow-lg">
                      Rs.{activeOrder.total}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-6 bg-surface/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-border z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Occupied</span>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-6 ml-2">
          <Users size={14} className="text-muted" />
          <span className="text-[10px] font-black text-muted uppercase tracking-widest">Total: {tables.length}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-6 ml-2">
          <span className="text-[10px] font-black text-primary/70 uppercase tracking-widest italic">Right-Click to Toggle Status</span>
        </div>
      </div>
    </div>
  );
}
