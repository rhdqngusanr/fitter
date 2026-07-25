import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

/**
 * 랜딩 (C-00).
 *
 * 두 사용자가 서로 다른 문장으로 들어온다.
 * 고객은 "이렇게 해주세요"를, 시공자는 "내 작업을 보여주겠다"를 하러 온다.
 * 한쪽만 말하는 랜딩은 나머지 절반을 잃는다.
 */
export default function HomePage() {
  return (
    <main>
      <section
        style={{
          background: 'var(--color-primary-50)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-16) var(--space-4)' }}
        >
          <h1 style={{ fontSize: 36, lineHeight: 1.3, margin: 0, maxWidth: 640 }}>
            사진으로 고르고, 사진으로 보여주세요
          </h1>
          <p
            style={{
              fontSize: 18,
              color: 'var(--color-text-secondary)',
              maxWidth: 560,
              margin: 'var(--space-4) 0 var(--space-8)',
            }}
          >
            원하는 분위기의 사진을 올리면 그 스타일을 실제로 시공해 본 사람이 찾아옵니다. 말로
            설명하지 않아도 됩니다.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Cta href="/requests/new" variant="primary">
              사진 올리고 시작하기
            </Cta>
            <Cta href="/gallery" variant="secondary">
              시공 사례 먼저 보기
            </Cta>
          </div>
        </div>
      </section>

      <section
        style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-12) var(--space-4)' }}
      >
        <h2 style={{ fontSize: 22, margin: '0 0 var(--space-4)' }}>어떤 공사를 찾으세요?</h2>
        {/* 공종 목록은 packages/shared 가 정본이다. 화면이 자기 목록을 들고 있지 않는다. */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          {WORK_CATEGORY_SEEDS.map((category) => (
            <li key={category.code}>
              <a
                href={`/gallery?categories=${category.code}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 40,
                  padding: '0 var(--space-4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {category.nameKo}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Cta({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const primary = variant === 'primary';
  return (
    <a
      href={href}
      role="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 var(--space-8)',
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        background: primary ? 'var(--color-primary-500)' : 'var(--color-surface)',
        color: primary ? 'var(--color-text-inverse)' : 'var(--color-primary-600)',
        border: `1px solid ${primary ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
      }}
    >
      {children}
    </a>
  );
}
