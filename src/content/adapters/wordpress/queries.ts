import { gql } from "./client";

// WPGraphQL caps `first` at 100 per request by default, so list queries take a cursor and the
// adapter walks it. PAGE_SIZE is that cap.
export const PAGE_SIZE = 100;

const IMAGE = gql`
  sourceUrl
  altText
  mediaDetails {
    width
    height
  }
`;

// Yoast shape, as exposed by the WPGraphQL Yoast SEO addon. Only requested when the schema has it.
const SEO = gql`
  seo {
    title
    metaDesc
    canonical
    metaRobotsNoindex
    opengraphImage {
      ${IMAGE}
    }
  }
`;

/** True when the Yoast addon's `PostTypeSEO` type exists in the schema. */
export const SEO_PROBE = gql`
  {
    __type(name: "PostTypeSEO") {
      name
    }
  }
`;

// Pages have no `excerpt` in WPGraphQL (they do not support excerpts), so it is derived from content.
function pageFields(seo: boolean) {
  return gql`
    fragment PageFields on Page {
      id
      uri
      title
      content
      date
      dateGmt
      modified
      modifiedGmt
      featuredImage {
        node {
          ${IMAGE}
        }
      }
      ${seo ? SEO : ""}
    }
  `;
}

function postBody(seo: boolean, withContent: boolean) {
  return gql`
    id
    slug
    title
    ${withContent ? "content" : ""}
    excerpt
    date
    dateGmt
    modified
    modifiedGmt
    author {
      node {
        name
      }
    }
    featuredImage {
      node {
        ${IMAGE}
      }
    }
    ${seo ? SEO : ""}
  `;
}

function postFields(seo: boolean) {
  return gql`
    fragment PostFields on Post {
      ${postBody(seo, true)}
    }
  `;
}

function postSummaryFields(seo: boolean) {
  return gql`
    fragment PostSummaryFields on Post {
      ${postBody(seo, false)}
    }
  `;
}

export const SITE_SETTINGS = gql`
  query SiteSettings {
    generalSettings {
      title
      description
      url
    }
  }
`;

// `generalSettings.url` is the WordPress home url, which is what menu item urls are written
// against. The adapter needs it to turn them into site-relative paths.
export const MENU = gql`
  query Menu($location: MenuLocationEnum!) {
    generalSettings {
      url
    }
    menus(where: { location: $location }) {
      nodes {
        menuItems(first: 100) {
          nodes {
            id
            parentId
            label
            url
            target
          }
        }
      }
    }
  }
`;

export const PAGE_BY_URI = (seo: boolean) => gql`
  query PageByUri($uri: ID!) {
    page(id: $uri, idType: URI) {
      ...PageFields
    }
  }
  ${pageFields(seo)}
`;

export const PAGE_PREVIEW = (seo: boolean) => gql`
  query PagePreview($id: ID!) {
    page(id: $id, idType: DATABASE_ID, asPreview: true) {
      ...PageFields
    }
  }
  ${pageFields(seo)}
`;

export const PAGE_URIS = gql`
  query PageUris($first: Int!, $after: String) {
    pages(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        uri
      }
    }
  }
`;

export const POST_BY_SLUG = (seo: boolean) => gql`
  query PostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      ...PostFields
    }
  }
  ${postFields(seo)}
`;

export const POST_PREVIEW = (seo: boolean) => gql`
  query PostPreview($id: ID!) {
    post(id: $id, idType: DATABASE_ID, asPreview: true) {
      ...PostFields
    }
  }
  ${postFields(seo)}
`;

export const POSTS = (seo: boolean) => gql`
  query Posts($first: Int!, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...PostSummaryFields
      }
    }
  }
  ${postSummaryFields(seo)}
`;

// Needs the wp-graphql-offset-pagination extension. Without it WordPress rejects the query with
// an error that names `offsetPagination`, which the adapter treats as "extension not installed".
export const POSTS_TOTAL = gql`
  query PostsTotal {
    posts(first: 1, where: { status: PUBLISH, offsetPagination: { size: 1, offset: 0 } }) {
      pageInfo {
        offsetPagination {
          total
        }
      }
    }
  }
`;

export const POST_SLUGS = gql`
  query PostSlugs($first: Int!, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        slug
      }
    }
  }
`;
