export type PageMeta = Partial<{
    title: string;
    description: string;
    ogImage: string;
}>;

export type ImageShape = {
    src: string;
    width?: number;
    height?: number;
    alt?: string;
    title?: string;
};

export type VideoShape = {
    media?: string;
    src: string;
    type: string;
}[];
