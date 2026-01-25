// 装箱算法相关类型定义

export interface ContainerDimensions {
    id?: string;
    length: number;
    width: number;
    height: number;
    max_weight?: number;
    unit: "mm" | "cm" | "m";
}

export interface PackingItem {
    id: string;
    name: string;
    length: number;
    width: number;
    height: number;
    weight?: number;
    quantity: number;
    color?: string;
    can_rotate?: boolean;
    item_type?: string;
    is_hollow?: boolean;
    density?: number;
}

export interface PackingOptions {
    allow_rotation: boolean;
    time_limit_sec: number;
    random_seed?: number;
    maximize_compactness: boolean;
    require_support: boolean;
    maximize_volume: boolean;
    enable_center_of_mass: boolean;
    center_of_mass_tolerance_per_mille: number;
    solver: "ortools" | "py3dbp";
    prefer_low_center_of_gravity: boolean;
    flat_sheet_vertical: boolean;
    large_items_first: boolean;
    greedy_weight_coefficient: number;
    cluster_weight: number;
    large_item_threshold_ratio: number;
    max_cg_height_ratio: number;
    min_support_ratio: number;
    strict_support: boolean;
    heavy_bottom: boolean;
    density_ratio_threshold: number;
    flat_sheet_lean: boolean;
    flat_sheet_lean_weight: number;
    long_rod_corner: boolean;
    long_rod_corner_weight: number;
    flat_sheet_long_edge_down: boolean;
    stagger_joints: boolean;
    min_stagger_ratio: number;
    long_rod_anti_pierce: boolean;
}

export interface PackingRequest {
    container: ContainerDimensions;
    items: PackingItem[];
    options: Partial<PackingOptions>;
}

export interface PackedItem {
    id: string;
    name: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    size: {
        length: number;
        width: number;
        height: number;
    };
    color?: string;
    opacity?: number;
    rotation_index?: number;
}

export interface PackingResponse {
    feasible: boolean;
    solver_status: string;
    message: string;
    container: ContainerDimensions;
    packed_items: any[];
    unpacked_items: any[];
    utilization: {
        container_volume: number;
        used_volume: number;
        unused_volume: number;
        fill_ratio: number;
    };
    render: {
        unit: string;
        container: {
            id: string;
            size: {
                length: number;
                width: number;
                height: number;
            };
        };
        items: PackedItem[];
    };
}

// 表单物品行数据
export interface FormItemRow {
    name: string;
    length: string;
    width: string;
    height: string;
    quantity: string;
    color: string;
}
